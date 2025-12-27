'use client'

interface Member {
  userId: string
  role: 'owner' | 'delegate'
  permissions: { allowedDocTypes: string[] }
}

interface MemberListProps {
  members: Member[]
}

export function MemberList({ members }: MemberListProps) {
  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.userId}
          className="flex items-center justify-between rounded-md border border-zinc-200 p-4 dark:border-zinc-700"
        >
          <div>
            <p className="font-medium text-black dark:text-zinc-50">
              {member.role === 'owner' ? 'Owner' : 'Delegate'}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {member.role === 'owner'
                ? 'Full access to all documents'
                : `Access to: ${member.permissions.allowedDocTypes.join(', ')}`}
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-50">
            {member.role}
          </span>
        </div>
      ))}
    </div>
  )
}

