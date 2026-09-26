const redis = require('../../config/redis')

const setCache = async (key, value) => {
  try {
    const todayEnd = Math.floor(new Date().setHours(23, 59, 59, 999) / 1000)
    await redis.set(
      key,
      JSON.stringify(value),
      'EX',
      todayEnd - Math.floor(Date.now() / 1000)
    )
    console.log(`Cache set for key: ${key}`)
  } catch (error) {
    console.error(`Failed to set cache for key: ${key}`, error)
  }
}

const setCacheWithTTL = async (key, value, ttlSeconds) => {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    console.log(`Cache set with TTL for key: ${key}, ttl=${ttlSeconds}`)
  } catch (error) {
    console.error(`Failed to set cache with TTL for key: ${key}`, error)
  }
}

const getCache = async (key) => {
  try {
    const cachedValue = await redis.get(key)
    if (cachedValue) {
      return JSON.parse(cachedValue)
    } else {
      return null
    }
  } catch (error) {
    console.error(`Failed to get cache for key: ${key}`, error)
    return null
  }
}

const delCache = async (key) => {
  try {
    await redis.del(key)
    console.log(`Cache deleted for key: ${key}`)
    return null
  } catch (error) {
    console.error(`Failed to delete cache for key: ${key}`, error)
    return null
  }
}

module.exports = { setCache, setCacheWithTTL, getCache, delCache }
