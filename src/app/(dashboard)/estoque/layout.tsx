import { ChatEstoque } from './components/ChatEstoque'

export default function EstoqueLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatEstoque />
    </>
  )
}
