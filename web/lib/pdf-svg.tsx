import "server-only";
import {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
} from "@react-pdf/renderer";
import { parseDocument } from "htmlparser2";
import type { ComponentType, ReactNode } from "react";

type ChildNode = ReturnType<typeof parseDocument>["children"][number];
type Element = Extract<ChildNode, { attribs: unknown }>;

// react-pdf draws SVG only from its own components, so an icon's markup is rebuilt from them.
// Anything else (masks, filters, <use>) makes the whole icon unusable here.
const ELEMENTS: Record<string, ComponentType<Record<string, unknown>>> = {
  circle: Circle,
  clipPath: ClipPath,
  defs: Defs,
  ellipse: Ellipse,
  g: G,
  line: Line,
  linearGradient: LinearGradient,
  path: Path,
  polygon: Polygon,
  polyline: Polyline,
  radialGradient: RadialGradient,
  rect: Rect,
  stop: Stop,
} as unknown as Record<string, ComponentType<Record<string, unknown>>>;

class Unsupported extends Error {}

function props(el: Element, key: number): Record<string, unknown> {
  const out: Record<string, unknown> = { key };
  for (const [name, value] of Object.entries(el.attribs)) {
    if (name === "style") {
      for (const decl of value.split(";")) {
        const [k, v] = decl.split(":").map((x) => x.trim());
        if (k && v) out[camel(k)] = v;
      }
    } else {
      out[camel(name)] = value;
    }
  }
  return out;
}

function camel(name: string) {
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function build(nodes: ChildNode[]): ReactNode[] {
  return nodes
    .filter((n): n is Element => "attribs" in n && n.type === "tag")
    .map((el, i) => {
      const Component = ELEMENTS[el.name];
      if (!Component) throw new Unsupported(el.name);
      return <Component {...props(el, i)}>{build(el.children as ChildNode[])}</Component>;
    });
}

export function svgChildren(body: string): ReactNode[] | null {
  try {
    return build(parseDocument(body, { xmlMode: true }).children);
  } catch (e) {
    if (e instanceof Unsupported) return null;
    throw e;
  }
}
