import type { ProductRepository, ProductInput, ProductRecord } from "./repository.js";

export class ProductService {
  constructor(private readonly products: ProductRepository) {}

  list(search?: string) { return this.products.list(search); }
  create(input: ProductInput) { return this.products.create(input); }
  update(id: number, input: ProductInput) { return this.products.update(id, input); }
  setActive(id: number, active: boolean) { return this.products.setActive(id, active); }
  setMinimumQuantity(id: number, minimumQuantity: number) { return this.products.setMinimumQuantity(id, minimumQuantity); }
}

export type { ProductInput, ProductRecord };
