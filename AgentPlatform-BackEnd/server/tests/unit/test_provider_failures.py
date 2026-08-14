"""What a failed turn is allowed to say to the person in the chat.

The upstream exception is operator detail: a 429 arrives as a JSON blob with a
billing URL and a docs link inside it. Rendering that in the answer bubble tells
the user nothing they can act on, so the mapping here is part of the product
copy, not a log format. Deliberately free of any ADK import so it runs without
the optional extra.
"""

from app.modules.llm.failures import provider_message

RAW_429 = (
    "429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'Your prepayment "
    "credits are depleted. Please go to AI Studio at https://ai.studio/projects "
    "to manage your project and billing. Learn more at "
    "https://ai.google.dev/gemini-api/docs/billing#prepay. ', 'status': "
    "'RESOURCE_EXHAUSTED'}}"
)


def test_quota_exhaustion_reads_as_a_wait_not_a_billing_dump():
    message = provider_message(Exception(RAW_429))
    assert message == "The model is out of quota right now. Try again in a few minutes."


def test_a_rejected_key_names_the_credentials_without_printing_them():
    message = provider_message(Exception("403 PERMISSION_DENIED: API key not valid"))
    assert message == "The model provider rejected its credentials. Check the server's API key."


def test_a_timeout_says_so():
    assert provider_message(TimeoutError("deadline exceeded")) == (
        "The model took too long to answer. Try again."
    )


def test_an_upstream_outage_reads_as_temporary():
    message = provider_message(Exception("503 UNAVAILABLE: The service is overloaded"))
    assert message == "The model provider is unavailable right now. Try again shortly."


def test_an_unrecognised_failure_falls_back_to_one_plain_sentence():
    message = provider_message(RuntimeError("upstream exploded"))
    assert message == "The model could not answer. Try again."


def test_no_mapped_message_leaks_the_raw_exception():
    """Every branch, including the fallback, must drop the upstream text."""
    failures = [
        Exception(RAW_429),
        Exception("403 PERMISSION_DENIED: API key not valid"),
        TimeoutError("deadline exceeded"),
        Exception("503 UNAVAILABLE: The service is overloaded"),
        RuntimeError("upstream exploded at https://internal.example/trace/abc"),
    ]
    for failure in failures:
        message = provider_message(failure)
        assert "http" not in message
        assert "{" not in message
        assert str(failure) not in message


def test_the_sentence_stays_short_enough_to_read_in_a_bubble():
    for failure in [Exception(RAW_429), RuntimeError("x")]:
        assert len(provider_message(failure)) < 120
