"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { useState, useRef, useEffect } from "react"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [hoverStyle, setHoverStyle] = useState({})
  const [activeStyle, setActiveStyle] = useState({ left: "0px", width: "0px" })
  const tabRefs = useRef<(HTMLElement | null)[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  // Update active index based on active tab
  useEffect(() => {
    if (listRef.current) {
      const activeTab = listRef.current.querySelector('[data-state="active"]')
      if (activeTab) {
        const tabs = Array.from(listRef.current.children).filter(
          child => child.hasAttribute('data-state')
        )
        const newActiveIndex = tabs.indexOf(activeTab)
        if (newActiveIndex !== -1) {
          setActiveIndex(newActiveIndex)
        }
      }
    }
  })

  useEffect(() => {
    if (hoveredIndex !== null) {
      const hoveredElement = tabRefs.current[hoveredIndex]
      if (hoveredElement) {
        const { offsetLeft, offsetWidth } = hoveredElement
        setHoverStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        })
      }
    }
  }, [hoveredIndex])

  useEffect(() => {
    const activeElement = tabRefs.current[activeIndex]
    if (activeElement) {
      const { offsetLeft, offsetWidth } = activeElement
      setActiveStyle({
        left: `${offsetLeft}px`,
        width: `${offsetWidth}px`,
      })
    }
  }, [activeIndex])

  useEffect(() => {
    requestAnimationFrame(() => {
      const firstElement = tabRefs.current[0]
      if (firstElement) {
        const { offsetLeft, offsetWidth } = firstElement
        setActiveStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        })
      }
    })
  }, [])

  return (
    <TabsPrimitive.List
      ref={(node) => {
        listRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      }}
      className={cn(
        "relative inline-flex h-10 items-center justify-center text-muted-foreground",
        className
      )}
      {...props}
    >
      {/* Hover Highlight */}
      <div
        className="absolute h-[30px] transition-all duration-300 ease-out bg-[#0e0f1114] dark:bg-[#ffffff1a] rounded-[6px] flex items-center"
        style={{
          ...hoverStyle,
          opacity: hoveredIndex !== null ? 1 : 0,
        }}
      />

      {/* Active Indicator */}
      <div
        className="absolute bottom-[-6px] h-[2px] bg-[#0e0f11] dark:bg-white transition-all duration-300 ease-out"
        style={activeStyle}
      />

      {/* Children with enhanced interaction */}
      {React.Children.map(props.children, (child, index) => {
        if (React.isValidElement(child)) {
          const childElement = child as React.ReactElement<any>
          return React.cloneElement(childElement, {
            ref: (el: HTMLElement | null) => {
              tabRefs.current[index] = el
              // Forward original ref if it exists
              const originalRef = (childElement as any).ref
              if (originalRef) {
                if (typeof originalRef === 'function') {
                  originalRef(el)
                } else if (originalRef && 'current' in originalRef) {
                  originalRef.current = el
                }
              }
            },
            onMouseEnter: (e: React.MouseEvent) => {
              setHoveredIndex(index)
              const originalOnMouseEnter = childElement.props?.onMouseEnter
              if (originalOnMouseEnter) {
                originalOnMouseEnter(e)
              }
            },
            onMouseLeave: (e: React.MouseEvent) => {
              setHoveredIndex(null)
              const originalOnMouseLeave = childElement.props?.onMouseLeave
              if (originalOnMouseLeave) {
                originalOnMouseLeave(e)
              }
            },
          })
        }
        return child
      })}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap px-3 py-2 text-sm font-medium ring-offset-background transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground h-[30px]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }