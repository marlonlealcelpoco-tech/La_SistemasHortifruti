import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCashDifference,
  validateCashTransaction,
  validateReturnCustomer,
  validateSaleCustomer,
  validateStockAdjustment
} from "./operational-rules.js";

test("conta a prazo exige cliente identificado", () => {
  assert.throws(() => validateSaleCustomer({ hasCreditSale: true, hasStoreCreditUse: false }), /Cliente identificado/);
  assert.doesNotThrow(() => validateSaleCustomer({ customerId: 10, hasCreditSale: true, hasStoreCreditUse: false }));
});

test("uso de crédito de troca exige cliente identificado", () => {
  assert.throws(() => validateSaleCustomer({ hasCreditSale: false, hasStoreCreditUse: true }), /Cliente identificado/);
  assert.doesNotThrow(() => validateSaleCustomer({ customerId: 10, hasCreditSale: false, hasStoreCreditUse: true }));
});

test("troca que gera crédito exige cliente", () => {
  assert.throws(() => validateReturnCustomer({ generatesStoreCredit: true }), /Cliente identificado/);
  assert.doesNotThrow(() => validateReturnCustomer({ customerId: 10, generatesStoreCredit: true }));
});

test("sangria e suprimento exigem valor e motivo", () => {
  assert.throws(() => validateCashTransaction(100), /Motivo/);
  assert.doesNotThrow(() => validateCashTransaction(100, "Sangria para depósito bancário"));
  assert.throws(() => validateCashTransaction(0, "Suprimento"), /maior que zero/);
});

test("fechamento calcula diferença entre contado e esperado", () => {
  assert.equal(calculateCashDifference({ expectedAmount: 500, countedAmount: 490 }), -10);
  assert.equal(calculateCashDifference({ expectedAmount: 500, countedAmount: 500 }), 0);
});

test("ajuste de estoque exige quantidade e motivo", () => {
  assert.throws(() => validateStockAdjustment(0, "Avaria"), /quantidade/);
  assert.throws(() => validateStockAdjustment(-1), /Motivo/);
  assert.doesNotThrow(() => validateStockAdjustment(-1, "Perda por avaria"));
});
