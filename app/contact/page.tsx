"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Leaf, Mail, MapPin, Phone } from "lucide-react"
import { PROGRAMS, PROJECTS } from "@/lib/savatree-catalog"

export default function ContactPage() {
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [prefilledAddress, setPrefilledAddress] = useState("")
  const [selectedService, setSelectedService] = useState("")
  const searchParams = useSearchParams()

  useEffect(() => {
    const address = searchParams.get("address")
    const service = searchParams.get("service")
    if (address) setPrefilledAddress(address)
    if (service) setSelectedService(service)
  }, [searchParams])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormSubmitted(true)
  }

  const serviceAreas = [
    "New York", "Connecticut", "New Jersey", "Massachusetts",
    "Pennsylvania", "Maryland", "Virginia", "Illinois",
    "Minnesota", "Colorado", "Washington", "Oregon",
  ]

  return (
    <div className="flex flex-col">
      <section className="bg-secondary py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/25 mb-4">
            <Leaf className="w-7 h-7 text-white" />
          </div>
          <h1 className="disp text-2xl md:text-3xl lg:text-4xl mb-4 text-secondary-foreground">
            Request a Consultation
          </h1>
          <p className="text-secondary-foreground/75 max-w-2xl mx-auto">
            Tell us about your property and a certified arborist will design a care plan tailored to your trees,
            shrubs, and landscape.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display font-semibold">Tell Us About Your Property</CardTitle>
                  <CardDescription>
                    We&apos;ll follow up within one business day to schedule a free on-site assessment.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!formSubmitted ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="first-name">First name</Label>
                          <Input id="first-name" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last-name">Last name</Label>
                          <Input id="last-name" required />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" type="email" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input id="phone" type="tel" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Property Address</Label>
                        <Input id="address" defaultValue={prefilledAddress} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="service">What are you interested in?</Label>
                        <select
                          id="service"
                          defaultValue={selectedService}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="">Select one</option>
                          <optgroup label="Care Programs">
                            {PROGRAMS.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Projects & Consulting">
                            {PROJECTS.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">Tell us about your property</Label>
                        <Textarea id="message" rows={4} placeholder="Number of trees, species if known, concerns, preferred timing…" />
                      </div>
                      <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        Request Free Assessment
                      </Button>
                    </form>
                  ) : (
                    <div className="py-12 text-center space-y-4">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
                        <Mail className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="text-lg md:text-xl font-semibold">Thank you for your request!</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        A certified arborist will contact you within one business day to schedule your free on-site
                        assessment and prepare a tailored care plan.
                      </p>
                      <Button onClick={() => setFormSubmitted(false)} variant="outline">
                        Submit Another Request
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display font-semibold">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 mt-0.5 text-primary" />
                    <div>
                      <p className="font-medium">Service Areas</p>
                      <p className="text-sm text-muted-foreground">Northeast, Mid-Atlantic,</p>
                      <p className="text-sm text-muted-foreground">Midwest &amp; West Coast branches</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Phone className="h-5 w-5 mt-0.5 text-primary" />
                    <div>
                      <p className="font-medium">Phone</p>
                      <a href="tel:8005433245" className="text-sm text-primary hover:underline">(800) 543-3245</a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-display font-semibold">Where We Work</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {serviceAreas.map((area) => (
                      <div key={area} className="text-sm text-muted-foreground">{area}</div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
