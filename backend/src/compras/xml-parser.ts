import { XMLParser } from "fast-xml-parser";
export type XmlPurchaseItem = { itemNumber: number; code: string; name: string; quantity: number; unitCost: number; total: number };
export type XmlPurchase = { accessKey?: string; number?: string; issuedAt?: string; supplier: { name?: string; document?: string }; items: XmlPurchaseItem[]; total: number };
function arrayOf<T>(value: T | T[] | undefined): T[] { if (value === undefined) return []; return Array.isArray(value) ? value : [value]; }
function valueOf(value: unknown): string | undefined { if (value === undefined || value === null) return undefined; return String(value).trim() || undefined; }
function numberOf(value: unknown, field: string): number { const parsed = Number(String(value).replace(",", ".")); if (!Number.isFinite(parsed)) throw new Error(`XML inválido: campo ${field} ausente ou inválido.`); return parsed; }
export function parseNfeXml(xml: string): XmlPurchase {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true, trimValues: true });
  const document = parser.parse(xml); const invoice = document.nfeProc?.NFe?.infNFe ?? document.NFe?.infNFe;
  if (!invoice) throw new Error("XML inválido: NF-e não encontrada.");
  const details = arrayOf(invoice.det); if (details.length === 0) throw new Error("XML inválido: a nota não possui itens.");
  const items = details.map((detail, index) => { const product = detail.prod; if (!product) throw new Error(`XML inválido: produto do item ${index + 1} não encontrado.`); const quantity = numberOf(product.qCom, "qCom"); const total = numberOf(product.vProd, "vProd"); return { itemNumber: Number(detail.nItem ?? index + 1), code: valueOf(product.cProd) ?? `XML-${index + 1}`, name: valueOf(product.xProd) ?? `Item XML ${index + 1}`, quantity, unitCost: numberOf(product.vUnCom ?? total / quantity, "vUnCom"), total }; });
  const accessKey = valueOf(invoice.Id)?.replace(/^NFe/, ""); const issuer = invoice.emit ?? {};
  return { accessKey, number: valueOf(invoice.ide?.nNF), issuedAt: valueOf(invoice.ide?.dhEmi ?? invoice.ide?.dEmi), supplier: { name: valueOf(issuer.xNome), document: valueOf(issuer.CNPJ ?? issuer.CPF) }, items, total: items.reduce((sum, item) => sum + item.total, 0) };
}
