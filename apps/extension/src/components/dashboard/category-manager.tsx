import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FolderPlus, Plus, Trash2 } from 'lucide-react';
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

  const deleteCategory = useMutation({
    mutationFn: (categoryId: string) =>
      sendMessage({ type: 'DELETE_CATEGORY', payload: { categoryId } }),
    onSuccess: (_data, categoryId) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (selectedCategoryId === categoryId) {
        onSelectionChange?.(null, null);
      }
      if (expandedCategory === categoryId) setExpandedCategory(null);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteSubcategory = useMutation({
    mutationFn: ({ categoryId, subcategoryId }: { categoryId: string; subcategoryId: string }) =>
      sendMessage({ type: 'DELETE_SUBCATEGORY', payload: { categoryId, subcategoryId } }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (selectedSubcategoryId === vars.subcategoryId) {
        onSelectionChange?.(vars.categoryId, null);
      }
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const selectCategory = (catId: string) => {
    const closing = expandedCategory === catId;
    setExpandedCategory(closing ? null : catId);
    // Only clear subcategory when switching to a different category
    if (selectedCategoryId !== catId) {
      onSelectionChange?.(catId, null);
    }
  };

  const selectSubcategory = (catId: string, subId: string) => {
    setExpandedCategory(catId);
    onSelectionChange?.(catId, subId);
  };

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedSubName = selectedCategory?.subcategories?.find(
    (s) => s.id === selectedSubcategoryId,
  )?.name;
  const hasSubsWithoutSelection =
    Boolean(selectedCategoryId) &&
    !selectedSubcategoryId &&
    (selectedCategory?.subcategories?.length ?? 0) > 0;

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
            <span className="font-medium text-foreground">
              {selectedSubName
                ? selectedSubName
                : (selectedCategory?.name ?? '—')}
            </span>
            {selectedSubName && selectedCategory?.name
              ? ` (in ${selectedCategory.name})`
              : null}
          </p>
        )}

        {hasSubsWithoutSelection && (
          <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-400">
            Click a subcategory below — scraping the parent category only is broader than your
            subcategory.
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

        <div className="max-h-40 space-y-1 overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat.id}>
              <div
                className={`flex w-full items-center gap-1 rounded-md px-1 py-0.5 ${
                  selectedCategoryId === cat.id && !selectedSubcategoryId ? 'bg-primary/10' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectCategory(cat.id)}
                  className="flex min-w-0 flex-1 items-center justify-between rounded-md px-1 py-1.5 text-xs hover:bg-secondary/50"
                >
                  <span className="truncate font-medium">{cat.name}</span>
                  <Badge variant="secondary" className="ml-1 shrink-0 text-[10px]">
                    {cat.subcategories?.length ?? 0}
                  </Badge>
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 px-0 text-muted-foreground hover:text-destructive"
                  title={`Delete ${cat.name}`}
                  disabled={deleteCategory.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(
                        `Delete category "${cat.name}" and all its subcategories?`,
                      )
                    ) {
                      deleteCategory.mutate(cat.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {expandedCategory === cat.id && (
                <div className="ml-3 space-y-1 border-l border-border pl-2">
                  {cat.subcategories?.map((sub) => (
                    <div
                      key={sub.id}
                      className={`flex items-center gap-1 rounded px-1 ${
                        selectedSubcategoryId === sub.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectSubcategory(cat.id, sub.id)}
                        className={`min-w-0 flex-1 rounded px-2 py-1 text-left text-xs hover:bg-secondary/50 ${
                          selectedSubcategoryId === sub.id
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {sub.name}
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 px-0 text-muted-foreground hover:text-destructive"
                        title={`Delete ${sub.name}`}
                        disabled={deleteSubcategory.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete subcategory "${sub.name}"?`)) {
                            deleteSubcategory.mutate({
                              categoryId: cat.id,
                              subcategoryId: sub.id,
                            });
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-1">
                    <input
                      value={newSubcategory}
                      onChange={(e) => setNewSubcategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newSubcategory.trim()) {
                          createSubcategory.mutate({
                            categoryId: cat.id,
                            name: newSubcategory.trim(),
                          });
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
                        createSubcategory.mutate({
                          categoryId: cat.id,
                          name: newSubcategory.trim(),
                        })
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
