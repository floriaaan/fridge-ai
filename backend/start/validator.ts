import vine, { symbols } from '@vinejs/vine'

vine.messagesProvider = (field) => {
  return `${field.name} is invalid`
}
