-- Covering indexes for the foreign keys the earlier migrations left bare.
create index research_runs_company_idx   on research_runs (company_id);
create index research_runs_replay_of_idx on research_runs (replay_of);
create index evidence_task_idx           on evidence (task_id);
create index evidence_technology_idx     on evidence (technology_id);
