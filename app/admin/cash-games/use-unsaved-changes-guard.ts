"use client"

import { useEffect, useRef } from "react"

/**
 * Warn before navigating away when `dirty` is true.
 * - Browser-level: standard `beforeunload` for tab close / refresh / external nav.
 * - In-app: intercepts left-clicks on `<a href>` elements that route elsewhere
 *   (Next.js App Router has no built-in route-change events). When intercepted,
 *   `onInternalNavAttempt` is called with a `proceed` callback the caller can
 *   invoke after confirmation.
 */
export function useUnsavedChangesGuard(
  dirty: boolean,
  onInternalNavAttempt: (proceed: () => void) => void
) {
  const dirtyRef = useRef(dirty)
  const handlerRef = useRef(onInternalNavAttempt)

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    handlerRef.current = onInternalNavAttempt
  }, [onInternalNavAttempt])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      // Required for some browsers to actually display the prompt.
      e.returnValue = ""
    }

    const onClickCapture = (e: MouseEvent) => {
      if (!dirtyRef.current) return
      if (e.defaultPrevented) return
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const target = e.target as HTMLElement | null
      const anchor = target?.closest("a") as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href) return
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return
      // Ignore in-page anchors and non-http schemes.
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return
      }

      // Compare destination to current location; if same path+search, allow.
      let destPath = href
      try {
        const url = new URL(href, window.location.href)
        if (url.origin !== window.location.origin) return // external — beforeunload handles it
        destPath = url.pathname + url.search + url.hash
      } catch {
        // Relative href fallback; treat as internal.
      }

      const current =
        window.location.pathname + window.location.search + window.location.hash
      if (destPath === current) return

      e.preventDefault()
      e.stopPropagation()
      handlerRef.current(() => {
        // Caller decided to proceed; perform the navigation.
        window.location.href = anchor.href
      })
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClickCapture, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClickCapture, true)
    }
  }, [])
}
