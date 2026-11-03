import logging

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    pass


def validate(form: dict) -> None:
    sin = form.get("sin", "")
    if len(sin) != 9:
        raise ValidationError(f"Invalid SIN {sin} for {form.get('email')}")


def handle(request_id: str, form: dict) -> int:
    try:
        validate(form)
    except ValidationError as error:
        logger.exception("Validation failed for request %s: %s", request_id, error)
        return 400
    return 204
