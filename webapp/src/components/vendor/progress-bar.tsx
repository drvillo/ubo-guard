'use client'

interface ProgressBarProps {
  currentStep: 1 | 2 | 3 | 4
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const steps = [
    { number: 1, label: 'Email Verification' },
    { number: 2, label: 'Code Verification' },
    { number: 3, label: 'Enter Secret' },
    { number: 4, label: 'Access Documents' },
  ]

  return (
    <div className="mb-6">
      <div className="flex items-start justify-between w-full">
        {steps.map((step) => {
          const isCompleted = step.number < currentStep
          const isCurrent = step.number === currentStep

          return (
            <div key={step.number} className="flex flex-col items-center flex-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors ${
                  isCompleted
                    ? 'border-black bg-black text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-black'
                    : isCurrent
                      ? 'border-black bg-white text-black dark:border-zinc-50 dark:bg-zinc-900 dark:text-zinc-50'
                      : 'border-zinc-300 bg-white text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500'
                }`}
              >
                {isCompleted ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium whitespace-nowrap ${
                  isCompleted || isCurrent
                    ? 'text-black dark:text-zinc-50'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

