"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  location: string;
  total: number;
  reserved: number;
  available: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  warehouses: WarehouseStock[];
}

function StockBadge({ available }: { available: number }) {
  if (available === 0) {
    return (
      <span style={{
        fontSize: "11px", fontFamily: "monospace",
        color: "var(--error)", backgroundColor: "#fef2f2",
        padding: "2px 7px", borderRadius: "4px", fontWeight: 600,
      }}>OUT OF STOCK</span>
    );
  }
  if (available <= 2) {
    return (
      <span style={{
        fontSize: "11px", fontFamily: "monospace",
        color: "var(--warning)", backgroundColor: "#fffbeb",
        padding: "2px 7px", borderRadius: "4px", fontWeight: 600,
      }}>ONLY {available} LEFT</span>
    );
  }
  return (
    <span style={{
      fontSize: "11px", fontFamily: "monospace",
      color: "var(--success)", backgroundColor: "#f0fdf4",
      padding: "2px 7px", borderRadius: "4px", fontWeight: 600,
    }}>{available} AVAILABLE</span>
  );
}

function ProductCard({ product, onReserve }: { product: Product; onReserve: (p: Product, w: WarehouseStock) => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReserve = async (warehouse: WarehouseStock) => {
    setError(null);
    setLoading(warehouse.warehouseId);
    try {
      await onReserve(product, warehouse);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{
      backgroundColor: "var(--card)",
      border: "1px solid var(--card-border)",
      borderRadius: "var(--radius)",
      overflow: "hidden",
      transition: "box-shadow 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      {product.imageUrl && (
        <div style={{ height: "180px", overflow: "hidden", backgroundColor: "#f3f4f6" }}>
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: "4px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace", letterSpacing: "0.5px" }}>
            {product.sku}
          </span>
        </div>
        <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, lineHeight: 1.3 }}>
          {product.name}
        </h3>
        {product.description && (
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
            {product.description}
          </p>
        )}
        <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent)", marginBottom: "16px" }}>
          ₹{product.price.toLocaleString("en-IN")}
        </div>

        <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "14px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Warehouse availability
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {product.warehouses.map((wh) => (
              <div key={wh.warehouseId} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {wh.warehouseName}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>{wh.location}</div>
                </div>
                <StockBadge available={wh.available} />
                <button
                  disabled={wh.available === 0 || loading === wh.warehouseId}
                  onClick={() => handleReserve(wh)}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    backgroundColor: wh.available === 0 ? "#e5e7eb" : "var(--accent)",
                    color: wh.available === 0 ? "var(--muted)" : "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: wh.available === 0 ? "not-allowed" : "pointer",
                    opacity: loading === wh.warehouseId ? 0.7 : 1,
                    transition: "background-color 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {loading === wh.warehouseId ? "Reserving…" : "Reserve"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: "10px",
            padding: "8px 12px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            fontSize: "12px",
            color: "var(--error)",
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleReserve = useCallback(async (product: Product, warehouse: WarehouseStock) => {
    const idempotencyKey = `reserve-${product.id}-${warehouse.warehouseId}-${Date.now()}`;

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        productId: product.id,
        warehouseId: warehouse.warehouseId,
        quantity: 1,
      }),
    });

    const data = await res.json();

    if (res.status === 409) {
      throw new Error(`Not enough stock: only ${data.available} unit(s) available`);
    }

    if (!res.ok) {
      throw new Error(data.error || "Reservation failed");
    }

    router.push(`/reservation/${data.id}`);
  }, [router]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
        Loading products…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: "20px",
        backgroundColor: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "8px",
        color: "var(--error)",
      }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
          Product Catalogue
        </h1>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: "14px" }}>
          {products.length} products · Reserve holds stock for 10 minutes while you check out
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "20px",
      }}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onReserve={handleReserve} />
        ))}
      </div>
    </div>
  );
}
