import type { ReactNode } from 'react'
import PrototypeApp from './newfolder-ui/PrototypeApp'
import './newfolder-ui/index.css'

type LandingPageProps = {
  onGetStarted: () => void
  onSignIn: () => void
  authOverlay?: ReactNode
}

export default function LandingPage(props: LandingPageProps) {
  return <PrototypeApp {...props} />
}
