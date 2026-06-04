import asyncio
import logging
from functools import wraps
from typing import Type

logger = logging.getLogger(__name__)


def async_retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: tuple[Type[Exception], ...] = (Exception,),
    non_retryable_exceptions: tuple[Type[Exception], ...] = (),
):
    """
    Decorator: retries an async function with exponential backoff.

    Delay formula: min(base_delay * exponential_base ** attempt, max_delay)
    With jitter: delay *= random(0.5, 1.5) to spread thundering-herd retries.

    Args:
        max_attempts:            Total attempts (1 = no retries).
        base_delay:              Initial wait in seconds.
        max_delay:               Cap on wait time.
        exponential_base:        Multiplier per attempt (2 → 1s, 2s, 4s…).
        jitter:                  Add ±50% random noise to delay.
        retryable_exceptions:    Only retry these exception types.
        non_retryable_exceptions: Never retry these (checked first).
    """
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            import random
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await fn(*args, **kwargs)
                except non_retryable_exceptions as e:
                    raise
                except retryable_exceptions as e:
                    last_exc = e
                    if attempt == max_attempts:
                        break
                    delay = min(base_delay * (exponential_base ** (attempt - 1)), max_delay)
                    if jitter:
                        delay *= random.uniform(0.5, 1.5)
                    logger.warning(
                        "%s failed (attempt %d/%d): %s — retrying in %.1fs",
                        fn.__qualname__, attempt, max_attempts, e, delay,
                    )
                    await asyncio.sleep(delay)
            logger.error("%s failed after %d attempts: %s", fn.__qualname__, max_attempts, last_exc)
            raise last_exc
        return wrapper
    return decorator


async def retry_call(
    fn,
    *args,
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: tuple[Type[Exception], ...] = (Exception,),
    non_retryable_exceptions: tuple[Type[Exception], ...] = (),
    **kwargs,
):
    """Inline retry wrapper for one-off calls without decorating the function."""
    decorated = async_retry(
        max_attempts=max_attempts,
        base_delay=base_delay,
        max_delay=max_delay,
        exponential_base=exponential_base,
        jitter=jitter,
        retryable_exceptions=retryable_exceptions,
        non_retryable_exceptions=non_retryable_exceptions,
    )(fn)
    return await decorated(*args, **kwargs)
