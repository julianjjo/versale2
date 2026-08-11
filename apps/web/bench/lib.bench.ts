import { bench, describe } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { extractApiError } from "@/lib/api";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  statusVariantFor,
} from "@/lib/order-status";
import { makeOrders, makeProducts } from "./fixtures";

function makeAxiosError(data: unknown): AxiosError {
  const error = new AxiosError("Request failed with status code 400");
  error.response = {
    data,
    status: 400,
    statusText: "Bad Request",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

const validationError = makeAxiosError({
  message: [
    "title should not be empty",
    "price must be a positive number",
    "condition must be one of the following values: New, Like New, Good, Fair",
  ],
});
const stringError = makeAxiosError({ message: "Credenciales inválidas" });
const plainError = new Error("boom");

describe("extractApiError", () => {
  bench("axios error with a list of validation messages", () => {
    extractApiError(validationError);
  });

  bench("axios error with a single message", () => {
    extractApiError(stringError);
  });

  bench("non-axios error", () => {
    extractApiError(plainError, "Request failed");
  });
});

const orders = makeOrders(500);

describe("order status mapping", () => {
  bench("map 500 orders to labels and badge variants", () => {
    const rows = orders.map((order) => ({
      id: order.id,
      label: ORDER_STATUS_LABEL[order.status],
      variant: statusVariantFor(order.status),
    }));
    if (rows.length !== orders.length) throw new Error("unexpected length");
  });

  bench("group 500 orders by status", () => {
    const grouped = new Map(ORDER_STATUSES.map((status) => [status, 0]));
    for (const order of orders) {
      grouped.set(order.status, (grouped.get(order.status) ?? 0) + 1);
    }
  });
});

const products = makeProducts(500);

describe("product list processing", () => {
  bench("filter + sort 500 products by price", () => {
    products
      .filter((product) => product.isApproved && product.price > 40000)
      .sort((a, b) => a.price - b.price)
      .slice(0, 12);
  });

  bench("build query params from filters", () => {
    const filters: Record<string, unknown> = {
      search: "chaqueta",
      minPrice: 20000,
      maxPrice: undefined,
      size: "M",
      brand: "",
      condition: "Good",
      page: 3,
      limit: 12,
    };
    const cleaned: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== "") {
        cleaned[k] = typeof v === "string" ? v : Number(v);
      }
    }
    new URLSearchParams(
      Object.entries(cleaned).map(([k, v]) => [k, String(v)]),
    ).toString();
  });
});
