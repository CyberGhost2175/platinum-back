export enum AnalyticsPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export enum AnalyticsReport {
  REVENUE = 'revenue',
  CATEGORIES = 'categories',
  MARGIN = 'margin',
  SELLERS = 'sellers',
  INVENTORY = 'inventory',
}

export enum AnalyticsExportFormat {
  XLSX = 'xlsx',
  PDF = 'pdf',
}

export enum AnalyticsGroupBy {
  ITEM_CATEGORY = 'itemCategory',
  METAL_CATEGORY = 'metalCategory',
  PRICE_SEGMENT = 'priceSegment',
}

export enum AnalyticsMarginLevel {
  PRODUCT = 'product',
  RECEIPT = 'receipt',
}

export enum PriceSegment {
  BUDGET = 'budget',
  MID = 'mid',
  PREMIUM = 'premium',
}
