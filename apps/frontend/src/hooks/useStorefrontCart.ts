import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Cart,
  CartItem,
  StorefrontService,
  StorefrontServiceOption,
} from "../types";

const STORAGE_KEY = "faztudo_storefront_cart";

// ==================== PERSISTENCE ====================

function loadCart(): Cart | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && parsed.storefrontId) {
        return parsed as Cart;
      }
    }
  } catch {
    // Corrupted — reset
  }
  return null;
}

function saveCart(cart: Cart | null): void {
  try {
    if (cart && cart.items.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage full or unavailable
  }
}

// ==================== PRICE HELPERS ====================

function calcUnitPrice(
  service: StorefrontService,
  selectedOptions: StorefrontServiceOption[],
): number {
  let price = service.price;
  for (const opt of selectedOptions) {
    if (opt.price != null) {
      price += opt.price;
    }
  }
  return price;
}

function calcCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.totalPrice, 0);
}

// ==================== HOOK ====================

/**
 * Hook para gerenciar carrinho de servicos de uma vitrine.
 *
 * O carrinho e vinculado a uma unica vitrine por vez.
 * Se o usuario adicionar servicos de outra vitrine, o carrinho anterior e limpo.
 *
 * @example
 * const { cart, addItem, removeItem, clearCart, itemCount } = useStorefrontCart();
 *
 * addItem({
 *   storefrontId: 1,
 *   storefrontName: "Joao Eletricista",
 *   storefrontSlug: "joao-eletricista",
 *   service,
 *   quantity: 1,
 *   selectedOptions: [option1],
 * });
 */
export function useStorefrontCart() {
  const [cart, setCart] = useState<Cart | null>(loadCart);

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setCart(loadCart());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Persist on every change
  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const addItem = useCallback(
    (params: {
      storefrontId: number;
      storefrontName: string;
      storefrontSlug: string;
      service: StorefrontService;
      quantity?: number;
      selectedOptions?: StorefrontServiceOption[];
    }) => {
      const {
        storefrontId,
        storefrontName,
        storefrontSlug,
        service,
        quantity = 1,
        selectedOptions = [],
      } = params;

      setCart((prev) => {
        // If different storefront, reset cart
        const isNewStorefront = prev && prev.storefrontId !== storefrontId;
        const base: Cart = isNewStorefront || !prev
          ? {
              storefrontId,
              storefrontName,
              storefrontSlug,
              items: [],
              totalPrice: 0,
            }
          : { ...prev };

        // Check if same service+options combo already exists
        const optionKey = selectedOptions
          .map((o) => o.id)
          .sort()
          .join(",");
        const existingIdx = base.items.findIndex((item) => {
          const itemOptKey = item.selectedOptions
            .map((o) => o.id)
            .sort()
            .join(",");
          return item.service.id === service.id && itemOptKey === optionKey;
        });

        let newItems: CartItem[];
        if (existingIdx >= 0) {
          // Update quantity
          newItems = base.items.map((item, idx) => {
            if (idx !== existingIdx) return item;
            const newQty = item.quantity + quantity;
            const unitPrice = calcUnitPrice(service, selectedOptions);
            return {
              ...item,
              quantity: newQty,
              unitPrice,
              totalPrice: unitPrice * newQty,
            };
          });
        } else {
          // Add new item
          const unitPrice = calcUnitPrice(service, selectedOptions);
          newItems = [
            ...base.items,
            {
              service,
              quantity,
              selectedOptions,
              unitPrice,
              totalPrice: unitPrice * quantity,
            },
          ];
        }

        return {
          ...base,
          items: newItems,
          totalPrice: calcCartTotal(newItems),
        };
      });
    },
    [],
  );

  const updateItemQuantity = useCallback(
    (serviceId: number, optionKey: string, quantity: number) => {
      setCart((prev) => {
        if (!prev) return null;

        let newItems: CartItem[];
        if (quantity <= 0) {
          newItems = prev.items.filter((item) => {
            const key = item.selectedOptions
              .map((o) => o.id)
              .sort()
              .join(",");
            return !(item.service.id === serviceId && key === optionKey);
          });
        } else {
          newItems = prev.items.map((item) => {
            const key = item.selectedOptions
              .map((o) => o.id)
              .sort()
              .join(",");
            if (item.service.id === serviceId && key === optionKey) {
              return {
                ...item,
                quantity,
                totalPrice: item.unitPrice * quantity,
              };
            }
            return item;
          });
        }

        if (newItems.length === 0) return null;
        return { ...prev, items: newItems, totalPrice: calcCartTotal(newItems) };
      });
    },
    [],
  );

  const removeItem = useCallback(
    (serviceId: number, optionKey?: string) => {
      setCart((prev) => {
        if (!prev) return null;

        const newItems = prev.items.filter((item) => {
          if (item.service.id !== serviceId) return true;
          if (optionKey !== undefined) {
            const key = item.selectedOptions
              .map((o) => o.id)
              .sort()
              .join(",");
            return key !== optionKey;
          }
          return false;
        });

        if (newItems.length === 0) return null;
        return { ...prev, items: newItems, totalPrice: calcCartTotal(newItems) };
      });
    },
    [],
  );

  const clearCart = useCallback(() => {
    setCart(null);
  }, []);

  const itemCount = useMemo(
    () => (cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0),
    [cart],
  );

  const getCheckoutPayload = useCallback((): {
    storefrontId: number;
    items: { serviceId: number; quantity: number; selectedOptionIds?: number[] }[];
  } | null => {
    if (!cart || cart.items.length === 0) return null;
    return {
      storefrontId: cart.storefrontId,
      items: cart.items.map((item) => ({
        serviceId: item.service.id,
        quantity: item.quantity,
        selectedOptionIds:
          item.selectedOptions.length > 0
            ? item.selectedOptions.map((o) => o.id)
            : undefined,
      })),
    };
  }, [cart]);

  return {
    cart,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
    itemCount,
    getCheckoutPayload,
  };
}
