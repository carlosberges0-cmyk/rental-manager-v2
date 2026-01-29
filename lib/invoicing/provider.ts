// Invoice Provider Interface
// This allows swapping between mock and real AFIP/ARCA providers

export interface InvoicePayload {
  unitId: string
  rentalPeriodId?: string
  issueDate: Date
  concept: string
  netAmount: number
  ivaAmount: number
  totalAmount: number
  currency: "ARS" | "USD"
}

export interface InvoiceResponse {
  externalId: string
  cae: string
  caeDueDate: Date
}

export interface InvoiceProvider {
  createInvoice(payload: InvoicePayload): Promise<InvoiceResponse>
}

// Mock Provider for MVP
export class MockInvoiceProvider implements InvoiceProvider {
  async createInvoice(payload: InvoicePayload): Promise<InvoiceResponse> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Generate mock response
    const externalId = `MOCK-${Date.now()}`
    const cae = Math.random().toString(36).substring(2, 15).toUpperCase()
    const caeDueDate = new Date()
    caeDueDate.setMonth(caeDueDate.getMonth() + 1)

    return {
      externalId,
      cae,
      caeDueDate,
    }
  }
}

// TODO: Real AFIP Provider
// To implement:
// 1. Install AFIP/ARCA SDK or use their API
// 2. Configure credentials via env vars:
//    - AFIP_CUIT
//    - AFIP_CERT_PATH
//    - AFIP_KEY_PATH
//    - AFIP_ENVIRONMENT (test/production)
// 3. Implement createInvoice method following AFIP documentation
// 4. Handle errors and retries appropriately
// 5. Update InvoiceProvider type to use real implementation

export class AFIPInvoiceProvider implements InvoiceProvider {
  // TODO: Implement real AFIP integration
  async createInvoice(payload: InvoicePayload): Promise<InvoiceResponse> {
    throw new Error("AFIP provider not yet implemented. Use mock provider for MVP.")
  }
}

// Factory function to get the appropriate provider
export function getInvoiceProvider(): InvoiceProvider {
  const providerType = process.env.INVOICE_PROVIDER || "mock"

  if (providerType === "afip") {
    return new AFIPInvoiceProvider()
  }

  return new MockInvoiceProvider()
}
