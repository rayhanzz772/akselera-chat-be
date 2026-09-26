function formatLog(oldRow, newRow, fields) {
  const changes = []
  const customFields = {
    picture: 'picture updated',
    logo: 'logo updated',
    thumbnail: 'thumbnail updated',
    icon: 'icon updated'
  }
  const maxLen = 20
  function short(val) {
    if (val === null || val === undefined) return ''
    const str = String(val)
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str
  }
  fields.forEach((field) => {
    const oldValue = oldRow[field]
    const newValue = newRow[field]
    if (oldValue !== newValue) {
      if (customFields[field]) {
        changes.push(customFields[field])
      } else {
        changes.push(`${field}: "${short(oldValue)}" → "${short(newValue)}"`)
      }
    }
  })
  if (changes.length === 0) return 'No changes'
  return changes.join(', ')
}

module.exports = { formatLog }
