import { useLocalSearchParams } from 'expo-router'
import { ReceiptDetailScreen } from '../../../presentation/receipt/receipt-detail-screen.js'

export default function ReceiptDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ReceiptDetailScreen receiptId={id} />
}
