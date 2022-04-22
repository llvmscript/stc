/* eslint-disable no-var */

/**
 * llvmscript's main TypeScript definition file.
 */

/**
 * The purpose of the types defined are to provide
 * llvmscript with detailed information so that it can
 * optimize your code better.
 *
 * These types are optional, and compilation
 * would still work without them, but letting the
 * compiler know what the type is exactly would
 * improve the efficiency of your code.
 *
 * What if you don't use these types?
 *
 * - 'number' will be treated as double
 */

/**
 * Signed 16 bit integer
 */
type i16 = number;

/**
 * Signed 32 bit integer
 */
type i32 = number;

/**
 * Signed 64 bit integer
 */
type i64 = number;

/**
 * Signed 16 bit float
 */
type f16 = number;

/**
 * Signed 32 bit float
 */
type f32 = number;

/**
 * Signed 64 bit float
 */
type f64 = number;

/**
 * Char type,
 * takes up a single byte in memory
 */
type char = string;
