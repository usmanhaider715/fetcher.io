import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FolderPlus, Plus } from 'lucide-react';
import type { Category } from '@fetcher/shared';
import { sendMessage } from '@/lib/messaging';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CategoryManagerProps {
  selectedCategoryId?: string | null;
  selectedSubcategoryId?: string | null;
  onSelectionChange?: (categoryId: string | null, subcategoryId: string | null) => void;
}

async function fetchCategories(): Promise<Category[]> {
  return sendMessage<undefined, Category[]>({ type: 'GET_CATEGORIES' });
}

export function CategoryManager({
  selectedCategoryId = null,
  selectedSubcategoryId = null,
  onSelectionChange,
}: CategoryManagerProps) {
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const createCategory = useMutation({
    mutationFn: (name: string) =>
      sendMessage<{ name: string }, Category>({ type: 'CREATE_CATEGORY', payload: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewCategory('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const createSubcategory = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      sendMessage({ type: 'CREATE_SUBCATEGORY', payload: { categoryId, name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewSubcategory('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const selectCategory = (catId: string) => {
    const next = expandedCategory === catId ? null : catId;
    setExpandedCategory(next);
    onSelectionChange?.(catId, null);
  };

  const selectSubcategory = (catId: string, subId: string) => {
    onSelectionChange?.(catId, subId);
  };

  if (isLoading) return null;

  return (
    <Card className="gradient-border">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FolderPlus className="h-4 w-4" />
          Categories
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {(selectedCategoryId || selectedSubcategoryId) && (
          <p className="text-[10px] text-muted-foreground">
            Scrape target:{' '}
            {categories.find((c) => c.id === selectedCategoryId)?.name ?? '—'}
            {selectedSubcategoryId &&
              ` / ${
                categories
                  .find((c) => c.id === selectedCategoryId)
                  ?.subcategories?.find((s) => s.id === selectedSubcategoryId)?.name ?? ''
              }`}
          </p>
        )}

        <div className="flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCategory.trim()) {
                createCategory.mutate(newCategory.trim());
              }
            }}
            placeholder="New category..."
            className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!newCategory.trim() || createCategory.isPending}
            onClick={() => createCategory.mutate(newCategory.trim())}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <div className="max-h-32 space-y-1 overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat.id}>
              <button
                type="button"
                onClick={() => selectCategory(cat.id)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-secondary/50 ${
                  selectedCategoryId === cat.id && !selectedSubcategoryId ? 'bg-primary/10' : ''
                }`}
              >
                <span className="font-medium">{cat.name}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {cat.subcategories?.length ?? 0}
                </Badge>
              </button>
              {expandedCategory === cat.id && (
                <div className="ml-3 space-y-1 border-l border-border pl-2">
                  {cat.subcategories?.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => selectSubcategory(cat.id, sub.id)}
                      className={`block w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-secondary/50 ${
                        selectedSubcategoryId === sub.id ? 'bg-primary/10 text-foreground' : ''
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}
                  <div className="flex gap-1">
                    <input
                      value={newSubcategory}
                      onChange={(e) => setNewSubcategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newSubcategory.trim()) {
                          createSubcategory.mutate({ categoryId: cat.id, name: newSubcategory.trim() });
                        }
                      }}
                      placeholder="Subcategory..."
                      className="h-7 flex-1 rounded border border-input bg-background px-2 text-[10px]"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      disabled={!newSubcategory.trim() || createSubcategory.isPending}
                      onClick={() =>
                        createSubcategory.mutate({ categoryId: cat.id, name: newSubcategory.trim() })
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">
              No categories yet — type a name and press +
            </p>
          )}
        </div>

        {error && <p className="text-center text-[10px] text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
