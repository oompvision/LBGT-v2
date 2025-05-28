import { ApplicationForm } from "./application-form"

export default function ApplyPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-center mb-6">Apply for Membership</h1>
      <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
        Join the Long Beach Golf Tour and become part of our community of golf enthusiasts. Fill out the form below to
        apply for membership.
      </p>
      <ApplicationForm />
    </div>
  )
}
