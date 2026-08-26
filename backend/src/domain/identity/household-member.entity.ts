import { Entity } from '#domain/shared/entity'
import type { HouseholdRole } from './household-role.vo.js'

interface HouseholdMemberProps {
  userId: string
  householdId: string
  role: HouseholdRole
  joinedAt: Date
}

export class HouseholdMember extends Entity<string> {
  private props: HouseholdMemberProps

  private constructor(id: string, props: HouseholdMemberProps) {
    super(id)
    this.props = props
  }

  static create(id: string, props: HouseholdMemberProps): HouseholdMember {
    return new HouseholdMember(id, props)
  }

  get userId(): string {
    return this.props.userId
  }

  get householdId(): string {
    return this.props.householdId
  }

  get role(): HouseholdRole {
    return this.props.role
  }

  get joinedAt(): Date {
    return this.props.joinedAt
  }
}
