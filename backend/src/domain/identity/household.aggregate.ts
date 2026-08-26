import { AggregateRoot } from '#domain/shared/aggregate-root'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import { HouseholdMember } from './household-member.entity.js'
import type { InviteCode } from './invite-code.vo.js'

interface HouseholdProps {
  name: string
  ownerId: string
  inviteCode: InviteCode
  members: HouseholdMember[]
  createdAt: Date
}

export class Household extends AggregateRoot<string> {
  private props: HouseholdProps

  private constructor(id: string, props: HouseholdProps) {
    super(id)
    this.props = props
  }

  static create(params: {
    id: string
    name: string
    ownerId: string
    ownerMemberId: string
    inviteCode: InviteCode
    createdAt: Date
  }): Household {
    const owner = HouseholdMember.create(params.ownerMemberId, {
      userId: params.ownerId,
      householdId: params.id,
      role: 'owner',
      joinedAt: params.createdAt,
    })

    return new Household(params.id, {
      name: params.name,
      ownerId: params.ownerId,
      inviteCode: params.inviteCode,
      members: [owner],
      createdAt: params.createdAt,
    })
  }

  /** Rehydrates an aggregate from persisted state — used by the mapper (Task 9). */
  static reconstruct(id: string, props: HouseholdProps): Household {
    return new Household(id, props)
  }

  get name(): string {
    return this.props.name
  }

  get ownerId(): string {
    return this.props.ownerId
  }

  get inviteCode(): InviteCode {
    return this.props.inviteCode
  }

  get members(): HouseholdMember[] {
    return this.props.members
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  regenerateInviteCode(newCode: InviteCode): void {
    this.props.inviteCode = newCode
  }

  addMember(memberId: string, userId: string, joinedAt: Date): ResultType<void, 'already_member'> {
    if (this.props.members.some((m) => m.userId === userId)) {
      return Result.err('already_member')
    }
    this.props.members.push(
      HouseholdMember.create(memberId, { userId, householdId: this.id, role: 'member', joinedAt }),
    )
    return Result.ok(undefined)
  }

  removeMember(userId: string): ResultType<void, 'cannot_remove_owner' | 'not_a_member'> {
    if (userId === this.props.ownerId) {
      return Result.err('cannot_remove_owner')
    }
    const index = this.props.members.findIndex((m) => m.userId === userId)
    if (index === -1) {
      return Result.err('not_a_member')
    }
    this.props.members.splice(index, 1)
    return Result.ok(undefined)
  }
}
