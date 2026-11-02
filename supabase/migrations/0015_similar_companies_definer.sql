-- Where the extensions schema belongs to a platform admin role and the grant in 0014 can't
-- take effect, callers can't resolve pgvector's operators. similar_companies() only reads
-- public catalog data, so let it run with its owner's rights instead.
alter function similar_companies(uuid, int) security definer;
