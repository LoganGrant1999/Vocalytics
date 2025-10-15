-- Cached uploads per user
create table if not exists user_videos (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  title text not null,
  thumbnail_url text,
  published_at timestamptz,
  stats jsonb default '{}'::jsonb, -- views, likes, commentCount, etc
  fetched_at timestamptz default now(),
  primary key (user_id, video_id)
);

-- Index for efficient lookups by user
create index if not exists user_videos_user_idx on user_videos (user_id, fetched_at desc);

-- Persisted analyses (store multiple runs; fetch latest)
create table if not exists video_analyses (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  analyzed_at timestamptz default now(),
  sentiment jsonb not null,  -- {pos, neu, neg}
  score numeric not null,    -- normalized [0..1] "positivity" score
  top_positive jsonb default '[]'::jsonb,
  top_negative jsonb default '[]'::jsonb,
  summary text,
  raw jsonb,
  primary key (user_id, video_id, analyzed_at)
);

-- Index for efficient lookups by user and video, ordered by time descending
create index if not exists video_analyses_ix on video_analyses (user_id, video_id, analyzed_at desc);

-- Index for trends queries
create index if not exists video_analyses_user_time_idx on video_analyses (user_id, analyzed_at desc);

-- Enable Row Level Security
alter table user_videos enable row level security;
alter table video_analyses enable row level security;

-- RLS Policies: Users can only see their own data
create policy "Users can view their own videos"
  on user_videos for select
  using (auth.uid() = user_id);

create policy "Users can insert their own videos"
  on user_videos for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own videos"
  on user_videos for update
  using (auth.uid() = user_id);

create policy "Users can delete their own videos"
  on user_videos for delete
  using (auth.uid() = user_id);

create policy "Users can view their own analyses"
  on video_analyses for select
  using (auth.uid() = user_id);

create policy "Users can insert their own analyses"
  on video_analyses for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own analyses"
  on video_analyses for update
  using (auth.uid() = user_id);

create policy "Users can delete their own analyses"
  on video_analyses for delete
  using (auth.uid() = user_id);
