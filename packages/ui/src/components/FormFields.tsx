import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import styles from './FormFields.module.css'

interface FieldWrapperProps {
  label?: string
  children: React.ReactNode
}

function FieldWrapper({ label, children }: FieldWrapperProps) {
  if (!label) return <>{children}</>
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className, ...props }: InputProps) {
  return (
    <FieldWrapper label={label}>
      <input className={[styles.input, className ?? ''].filter(Boolean).join(' ')} {...props} />
    </FieldWrapper>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, className, children, ...props }: SelectProps) {
  return (
    <FieldWrapper label={label}>
      <select className={[styles.select, className ?? ''].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
    </FieldWrapper>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, className, ...props }: TextareaProps) {
  return (
    <FieldWrapper label={label}>
      <textarea className={[styles.textarea, className ?? ''].filter(Boolean).join(' ')} {...props} />
    </FieldWrapper>
  )
}
