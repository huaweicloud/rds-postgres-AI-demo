create index companies_stack_embedding_idx on companies
  using hnsw (stack_embedding extensions.vector_cosine_ops);

create function similar_companies(target uuid, k int default 5)
returns table (id uuid, name text, domain text, similarity real) language sql stable
  set search_path = public, extensions as $$
  select c.id, c.name, c.domain, (1 - (c.stack_embedding <=> t.stack_embedding))::real
    from companies c, companies t
   where t.id = target and c.id <> target and c.stack_embedding is not null
   order by c.stack_embedding <=> t.stack_embedding
   limit k;
$$;

-- The merger's fallback for names with no alias match.
create function match_technology(query_embedding extensions.vector(1024), min_similarity real default 0.9)
returns table (id int, slug text, name text, category text, similarity real)
language sql stable
  set search_path = public, extensions as $$
  select t.id, t.slug, t.name, t.category,
         (1 - (t.name_embedding <=> query_embedding))::real
    from technologies t
   where t.name_embedding is not null
     and 1 - (t.name_embedding <=> query_embedding) >= min_similarity
   order by t.name_embedding <=> query_embedding
   limit 1;
$$;
