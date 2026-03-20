export interface Project {
  id: string;
  name: string;
  launchId?: string;
  launchName?: string;
}

export interface PeriodOption {
  value: string;
  label: string;
}

export interface MarketingKpi {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  source?: string;
  showView?: boolean;
  showConfigure?: boolean;
  highlightPositive?: boolean;
}

export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface IntegrationCard {
  id: string;
  name: string;
  slug: string;
  description: string;
  connected: boolean;
  lastSync?: string;
  logo?: string;
}
