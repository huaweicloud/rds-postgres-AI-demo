import ipaddr from "ipaddr.js";
import { describe, expect, it } from "vitest";
import {
  fromHeaders,
  fromHost,
  fromHtml,
  fromMx,
  fromNs,
  fromSubdomainName,
  fromTxt,
} from "../src/agents/footprint/analyze.js";
import { cleanHosts, pickHosts } from "../src/agents/footprint/ct.js";
import { IpRangeIndex, type Prefix } from "../src/agents/footprint/ipranges.js";
import { TECH, matchNameServer, matchSuffix } from "../src/agents/footprint/rules.js";

const prefix = (cidr: string, tech = TECH.aws, label = "AWS EC2 us-east-1"): Prefix => {
  const [network, bits] = ipaddr.parseCIDR(cidr);
  return { network, bits, tech, label, source: "test" };
};

describe("CNAME suffix table", () => {
  it.each([
    ["d111111abcdef8.cloudfront.net", "Amazon CloudFront"],
    ["my-app.azurewebsites.net.", "Azure App Service"],
    ["shop.myshopify.com", "Shopify"],
    ["acme.github.io", "GitHub"],
    ["x.elb.amazonaws.com", "AWS Elastic Load Balancing"],
    ["thing.us-east-1.amazonaws.com", "Amazon Web Services"],
    ["www.example.com.edgekey.net", "Akamai"],
  ])("%s → %s", (host, name) => {
    expect(matchSuffix(host)?.tech.name).toBe(name);
  });

  it("does not match a suffix in the middle of a name", () => {
    expect(matchSuffix("cloudfront.net.evil.example")).toBeNull();
  });

  it("recognizes Route 53 and Cloudflare name servers", () => {
    expect(matchNameServer("ns-1234.awsdns-12.org.")?.name).toBe("Amazon Web Services");
    expect(matchNameServer("kim.ns.cloudflare.com")?.name).toBe("Cloudflare");
    expect(matchNameServer("ns1.example.net")).toBeNull();
  });
});

describe("IP range matching", () => {
  const index = new IpRangeIndex([
    prefix("52.84.0.0/15", TECH.cloudfront, "AWS CLOUDFRONT GLOBAL"),
    prefix("52.0.0.0/11"),
    prefix("2600:9000::/28", TECH.cloudfront, "AWS CLOUDFRONT GLOBAL"),
    prefix("104.16.0.0/13", TECH.cloudflare, "Cloudflare"),
  ]);

  it("picks the most specific prefix", () => {
    expect(index.match("52.84.10.20")?.tech.name).toBe("Amazon CloudFront");
    expect(index.match("52.1.2.3")?.tech.name).toBe("Amazon Web Services");
  });

  it("matches IPv6 and IPv4-mapped addresses", () => {
    expect(index.match("2600:9000:1234::1")?.tech.name).toBe("Amazon CloudFront");
    expect(index.match("::ffff:104.16.1.1")?.tech.name).toBe("Cloudflare");
  });

  it("returns null outside every range and for junk", () => {
    expect(index.match("8.8.8.8")).toBeNull();
    expect(index.match("not-an-ip")).toBeNull();
  });

  it("only uses an address when the CNAME didn't name the provider", () => {
    const viaCname = fromHost(
      { host: "cdn.acme.com", cnames: ["d1.cloudfront.net"], addresses: ["52.84.1.1"] },
      index,
    );
    expect(viaCname).toHaveLength(1);
    expect(viaCname[0]!.snippet).toBe("cdn.acme.com. CNAME d1.cloudfront.net.");
    expect(viaCname[0]!.source_url).toBe("dns:cdn.acme.com?type=CNAME");

    const viaIp = fromHost({ host: "api.acme.com", cnames: [], addresses: ["104.16.5.5"] }, index);
    expect(viaIp[0]!.raw_name).toBe("Cloudflare");
    expect(viaIp[0]!.snippet).toContain("104.16.0.0/13");
  });
});

describe("DNS record findings", () => {
  it("maps MX hosts to mail providers", () => {
    const f = fromMx("acme.com", [{ exchange: "aspmx.l.google.com", priority: 1 }]);
    expect(f.map((x) => x.raw_name)).toEqual(["Google Workspace"]);
    expect(f[0]!.snippet).toBe("acme.com. MX 1 aspmx.l.google.com.");
  });

  it("reads SPF includes and verification tokens", () => {
    const f = fromTxt("acme.com", [
      "v=spf1 include:_spf.google.com include:sendgrid.net ~all",
      "atlassian-domain-verification=abc123",
      "some unrelated record",
    ]);
    expect(f.map((x) => x.raw_name).sort()).toEqual(["Atlassian", "Google Workspace", "SendGrid"]);
  });

  it("reads name servers", () => {
    expect(fromNs("acme.com", ["ns-1.awsdns-01.com"])[0]!.raw_name).toBe("Amazon Web Services");
  });

  it("hints at tools from subdomain labels only", () => {
    expect(
      fromSubdomainName("grafana.acme.com", "acme.com", "https://crt.sh/?q=acme.com")[0]?.raw_name,
    ).toBe("Grafana");
    expect(fromSubdomainName("grafana.acme.com", "acme.com", "x")[0]?.confidence).toBe(0.5);
    expect(fromSubdomainName("mygrafana-docs.acme.com", "acme.com", "x")).toEqual([]);
  });
});

describe("HTTP findings", () => {
  it("reads CDN and framework headers", () => {
    const headers = new Headers({
      server: "cloudflare",
      "cf-ray": "abc",
      "x-powered-by": "Next.js",
    });
    const names = fromHeaders("https://acme.com/", headers).map((x) => x.raw_name);
    expect(names).toEqual(["Cloudflare", "Next.js"]);
  });

  it("quotes the homepage markup it matched", () => {
    const html = `<html><head><script src="https://www.googletagmanager.com/gtm.js?id=GTM-X"></script></head>
      <body><script id="__NEXT_DATA__" type="application/json">{}</script></body></html>`;
    const f = fromHtml("https://acme.com/", html);
    expect(f.map((x) => x.raw_name).sort()).toEqual(["Google Tag Manager", "Next.js"]);
    for (const x of f) expect(html.replace(/\s+/g, " ")).toContain(x.snippet);
  });
});

describe("certificate transparency names", () => {
  it("cleans wildcards, the apex and foreign names", () => {
    const hosts = cleanHosts(
      ["*.acme.com\napi.acme.com", "acme.com", "evil.com", "WWW.ACME.COM."],
      "acme.com",
    );
    expect(hosts.sort()).toEqual(["api.acme.com", "www.acme.com"]);
  });

  it("keeps short names first and caps the list", () => {
    const hosts = ["a.b.c.acme.com", "api.acme.com", "grafana.acme.com", "x.acme.com"];
    expect(pickHosts(hosts, 3)).toEqual(["x.acme.com", "api.acme.com", "grafana.acme.com"]);
  });
});
