export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  role_type: string;
  fit_score: number;
  status: string;
  is_saved: boolean;
  deadline: string | null;
  description: string;
  updated_at: string;
}

export interface Filters {
  search: string;
  min_score: string;
  status: string;
  location: string;
  source: string;
  role_type: string;
  deadline_filter: string;
}
