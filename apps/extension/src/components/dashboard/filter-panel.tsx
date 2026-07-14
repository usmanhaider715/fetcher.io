import { PRODUCT_SORT_FILTERS, type ProductSortFilter } from '@fetcher/shared';
import { SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface ScrapeFilters {
  sortFilter: ProductSortFilter;
  maxPages: number;
  minRating: number;
  minReviews: number;
}

interface FilterPanelProps {
  filters: ScrapeFilters;
  onChange: (filters: ScrapeFilters) => void;
  showPagination?: boolean;
}

export function FilterPanel({ filters, onChange, showPagination = true }: FilterPanelProps) {
  const inputClass =
    'h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <Card className="gradient-border">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <SlidersHorizontal className="h-4 w-4" />
          Sort & Filters
        </CardTitle>
        <CardDescription className="text-xs">
          Sort results and filter by rating or review count
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <div className="space-y-1">
          <label htmlFor="sort-filter" className="text-xs font-medium text-muted-foreground">
            Sort by
          </label>
          <select
            id="sort-filter"
            value={filters.sortFilter}
            onChange={(e) =>
              onChange({ ...filters, sortFilter: e.target.value as ProductSortFilter })
            }
            className={inputClass}
          >
            {PRODUCT_SORT_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {showPagination && (
          <div className="space-y-1">
            <label htmlFor="max-pages" className="text-xs font-medium text-muted-foreground">
              Pages to scrape
            </label>
            <input
              id="max-pages"
              type="number"
              min={1}
              max={50}
              value={filters.maxPages}
              onChange={(e) =>
                onChange({ ...filters, maxPages: Math.max(1, parseInt(e.target.value, 10) || 1) })
              }
              className={inputClass}
            />
            <p className="text-[10px] text-muted-foreground">
              Number of listing pages to scrape (1 = current page only)
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor="min-rating" className="text-xs font-medium text-muted-foreground">
              Min rating
            </label>
            <input
              id="min-rating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={filters.minRating || ''}
              placeholder="0"
              onChange={(e) =>
                onChange({ ...filters, minRating: parseFloat(e.target.value) || 0 })
              }
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="min-reviews" className="text-xs font-medium text-muted-foreground">
              Min reviews
            </label>
            <input
              id="min-reviews"
              type="number"
              min={0}
              value={filters.minReviews || ''}
              placeholder="0"
              onChange={(e) =>
                onChange({ ...filters, minReviews: parseInt(e.target.value, 10) || 0 })
              }
              className={inputClass}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
