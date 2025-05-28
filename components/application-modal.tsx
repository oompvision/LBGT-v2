"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ApplicationForm } from "@/app/apply/application-form"

interface ApplicationModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ApplicationModal({ isOpen, onClose }: ApplicationModalProps) {
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmitSuccess = () => {
    setIsSubmitted(true)
    setTimeout(() => {
      onClose()
      setIsSubmitted(false)
    }, 3000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">Apply for Membership</DialogTitle>
        </DialogHeader>
        {isSubmitted ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <h3 className="mb-2 text-xl font-semibold text-green-600">Application Submitted!</h3>
            <p className="text-muted-foreground">
              Thank you for your application. We will review it and get back to you soon.
            </p>
          </div>
        ) : (
          <ApplicationForm isModal onSubmitSuccess={handleSubmitSuccess} />
        )}
      </DialogContent>
    </Dialog>
  )
}
