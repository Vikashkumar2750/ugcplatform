-- Create daily_account_metrics table for historical tracking of Net Followers and other KPI
CREATE TABLE IF NOT EXISTS public.daily_account_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connected_account_id UUID NOT NULL REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    follower_count INT NOT NULL DEFAULT 0,
    following_count INT DEFAULT 0,
    media_count INT DEFAULT 0,
    net_followers_change INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one record per account per day
    UNIQUE(connected_account_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_account_metrics ENABLE ROW LEVEL SECURITY;

-- Create policy so users can only see their own metrics
CREATE POLICY "Users can view own daily metrics" ON public.daily_account_metrics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily metrics" ON public.daily_account_metrics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily metrics" ON public.daily_account_metrics
    FOR UPDATE USING (auth.uid() = user_id);

-- Create an index to speed up time-series queries
CREATE INDEX idx_daily_account_metrics_account_date ON public.daily_account_metrics(connected_account_id, date DESC);
