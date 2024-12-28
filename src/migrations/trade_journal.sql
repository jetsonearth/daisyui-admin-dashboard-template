-- Create journal_entries table
create table if not exists journal_entries (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    date date not null,
    reflection text,
    market_notes text,
    lessons_learned text,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now()),
    unique(user_id, date)
);

-- Create missed_trades table
create table if not exists missed_trades (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    date date not null,
    ticker text not null,
    reason text,
    notes text,
    potential_profit numeric(10,2) default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add RLS policies for journal_entries
alter table journal_entries enable row level security;

create policy "Users can view their own journal entries"
    on journal_entries for select
    using (auth.uid() = user_id);

create policy "Users can insert their own journal entries"
    on journal_entries for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own journal entries"
    on journal_entries for update
    using (auth.uid() = user_id);

create policy "Users can delete their own journal entries"
    on journal_entries for delete
    using (auth.uid() = user_id);

-- Add RLS policies for missed_trades
alter table missed_trades enable row level security;

create policy "Users can view their own missed trades"
    on missed_trades for select
    using (auth.uid() = user_id);

create policy "Users can insert their own missed trades"
    on missed_trades for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own missed trades"
    on missed_trades for update
    using (auth.uid() = user_id);

create policy "Users can delete their own missed trades"
    on missed_trades for delete
    using (auth.uid() = user_id);

-- Add indexes for better performance
create index if not exists idx_journal_entries_user_date 
    on journal_entries(user_id, date);

create index if not exists idx_missed_trades_user_date 
    on missed_trades(user_id, date);
