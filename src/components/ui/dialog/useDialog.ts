import { useEffect, useRef } from 'react'

export const useDialog = ({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: () => void }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, setIsOpen])

  return {
    containerRef,
  }
}
