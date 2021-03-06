'use strict'

const errCode = require('err-code')
const uint8ArrayFromString = require('uint8arrays/from-string')
const browserStreamToIt = require('browser-readablestream-to-it')
const blobToIt = require('blob-to-it')
const itPeekable = require('it-peekable')
const all = require('it-all')
const map = require('it-map')
const {
  isBytes,
  isReadableStream,
  isBlob
} = require('./utils')

/**
 * @param {import('./normalise-input').ToContent} input
 * @returns {AsyncIterable<Uint8Array>}
 */
async function * toAsyncIterable (input) {
  // Bytes | String
  if (isBytes(input) || typeof input === 'string' || input instanceof String) {
    yield toBytes(input)
    return
  }

  // Blob
  if (isBlob(input)) {
    yield * blobToIt(input)
    return
  }

  // Browser stream
  if (isReadableStream(input)) {
    input = browserStreamToIt(input)
  }

  // (Async)Iterator<?>
  if (input[Symbol.iterator] || input[Symbol.asyncIterator]) {
    const peekable = itPeekable(input)
    const { value, done } = await peekable.peek()

    if (done) {
      // make sure empty iterators result in empty files
      yield * peekable
      return
    }

    peekable.push(value)

    // (Async)Iterable<Number>
    if (Number.isInteger(value)) {
      yield Uint8Array.from((await all(peekable)))
      return
    }

    // (Async)Iterable<Bytes|String>
    if (isBytes(value) || typeof value === 'string' || value instanceof String) {
      yield * map(peekable, toBytes)
      return
    }
  }

  throw errCode(new Error(`Unexpected input: ${input}`), 'ERR_UNEXPECTED_INPUT')
}

/**
 *
 * @param {ArrayBuffer | ArrayBufferView | string | InstanceType<typeof window.String> | number[]} chunk
 * @returns {Uint8Array}
 */
function toBytes (chunk) {
  if (chunk instanceof Uint8Array) {
    return chunk
  }

  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
  }

  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk)
  }

  if (Array.isArray(chunk)) {
    return Uint8Array.from(chunk)
  }

  return uint8ArrayFromString(chunk)
}

module.exports = toAsyncIterable
