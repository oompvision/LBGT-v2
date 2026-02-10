"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { MessageBox } from "@/components/message-box"
import { useAuth } from "@/components/auth-provider"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoBoxSection } from "@/components/info-box-section"
import { PlayoffResultsSection } from "@/components/playoff-results-section"

export default function Home() {
  const { user, isLoading } = useAuth()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted || isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-black">
          <div className="absolute inset-0 z-10 bg-black/40" />
          <video
            autoPlay
            muted
            loop
            playsInline
            className="h-[60vh] w-full object-cover"
            style={{ marginTop: "-2px", marginBottom: "-2px" }}
          >
            <source src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/middlebay%202%20%281%29-iUgCCVQ68sZlJrMSRpPQFZcFH1wXpW.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="text-center text-white" style={{ marginTop: "20px" }}>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-6xl">
                Welcome to The Long Beach Golf Tour
              </h1>
              <p className="mb-2 text-xl sm:text-2xl">Est. 2021</p>
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center mt-8">
                {user ? (
                  <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 text-white">
                    <Link href="/book-tee-time">Reserve Tee Time</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 text-white">
                      <Link href="/signin">Sign In</Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="border-white text-white hover:bg-white hover:text-black bg-transparent"
                    >
                      <Link href="/apply">Apply to Join</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Message Box */}
        <MessageBox />

        {/* Info Boxes Section */}
        <InfoBoxSection />

        {/* LBGT Playoff Results */}
        <PlayoffResultsSection />

        {/* Instagram Embed */}
        <section className="py-16 bg-muted/50">
          <div className="container max-w-3xl">
            <div className="flex justify-center">
              <blockquote
                className="instagram-media"
                data-instgrm-permalink="https://www.instagram.com/thelongbeachgolftour/?utm_source=ig_embed&amp;utm_campaign=loading"
                data-instgrm-version="14"
                style={{
                  background: "#FFF",
                  border: 0,
                  borderRadius: "3px",
                  boxShadow: "0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)",
                  margin: "1px",
                  maxWidth: "540px",
                  minWidth: "326px",
                  padding: 0,
                  width: "99.375%",
                }}
              >
                <div style={{ padding: "16px" }}>
                  <a
                    href="https://www.instagram.com/thelongbeachgolftour/?utm_source=ig_embed&amp;utm_campaign=loading"
                    style={{
                      background: "#FFFFFF",
                      lineHeight: 0,
                      padding: "0 0",
                      textAlign: "center",
                      textDecoration: "none",
                      width: "100%",
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View this profile on Instagram
                  </a>
                </div>
              </blockquote>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      {/* Instagram Embed Script */}
      <script async src="//www.instagram.com/embed.js"></script>
    </div>
  )
}
