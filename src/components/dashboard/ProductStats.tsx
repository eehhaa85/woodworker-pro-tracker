import { useMemo } from 'react';
import { formatRub } from '@/lib/rates';
import { Package } from 'lucide-react';

interface Entry {
  date: string;
  product_id: string | null;
  product_quantity: number;
  products?: { name: string; price: number } | null;
  total_amount: number;
  hours: number;
  full_sheets: number;
  half_sheets: number;
}

interface ProductStat {
  name: string;
  quantity: number;
  earned: number;
}

const ProductStats = ({ entries, monthStart }: { entries: Entry[]; monthStart: string }) => {
  const productStats = useMemo(() => {
    const map = new Map<string, ProductStat>();

    for (const e of entries) {
      if (e.date < monthStart) continue;
      if (!e.product_id || !e.products || e.product_quantity <= 0) continue;

      const key = e.product_id;
      const productEarned = e.products.price * e.product_quantity;
      const existing = map.get(key);

      if (existing) {
        existing.quantity += e.product_quantity;
        existing.earned += productEarned;
      } else {
        map.set(key, {
          name: e.products.name,
          quantity: e.product_quantity,
          earned: productEarned,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.earned - a.earned);
  }, [entries, monthStart]);

  if (productStats.length === 0) return null;

  const totalEarned = productStats.reduce((sum, p) => sum + p.earned, 0);
  const totalQty = productStats.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <div>
      <p className="label-industrial text-xs mb-3">Серийная мебель (текущий месяц)</p>
      <div className="stat-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package size={14} />
            <span className="text-xs font-medium">Всего: {totalQty} шт.</span>
          </div>
          <p className="text-lg font-bold font-display text-primary">{formatRub(totalEarned)}</p>
        </div>
        <div className="border-t border-border pt-3 space-y-2">
          {productStats.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground truncate">{p.name}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">×{p.quantity}</span>
                <span className="text-sm font-bold font-display text-primary">{formatRub(p.earned)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductStats;
