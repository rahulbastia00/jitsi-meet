import uuid
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _


class Organization(models.Model):
    """
    Top-level workspace or organization entity.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_organizations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("organization")
        verbose_name_plural = _("organizations")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class OrganizationTeam(models.Model):
    """
    Department or sub-team within an organization (e.g., Backend, Frontend, Design).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="teams",
    )
    name = models.CharField(max_length=64)
    color_tag = models.CharField(max_length=16, default="#3B82F6")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("organization team")
        verbose_name_plural = _("organization teams")
        ordering = ["name"]
        unique_together = ("org", "name")

    def __str__(self) -> str:
        return f"{self.org.name} - {self.name}"


class OrganizationMember(models.Model):
    """
    Membership record joining a user to an organization, with team assignment
    and granular AWS IAM-style policy toggles.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('invited', 'Invited'),
        ('suspended', 'Suspended'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="org_memberships",
    )
    team = models.ForeignKey(
        OrganizationTeam,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="team_members",
    )
    is_owner = models.BooleanField(default=False)
    can_create_meeting = models.BooleanField(default=True)
    can_delete_meeting = models.BooleanField(default=False)
    can_use_ai = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("organization member")
        verbose_name_plural = _("organization members")
        unique_together = ('org', 'user')
        ordering = ["-joined_at"]

    def clean(self) -> None:
        super().clean()
        if self.is_owner:
            if self.status == 'suspended':
                raise ValidationError({"status": _("Organization owner cannot be suspended.")})
            if not self.can_create_meeting or not self.can_delete_meeting or not self.can_use_ai:
                raise ValidationError(_("Cannot revoke permissions from the organization owner."))

    def delete(self, *args, **kwargs):
        if self.is_owner:
            raise ValidationError(_("Cannot delete the organization owner's membership."))
        return super().delete(*args, **kwargs)

    def save(self, *args, **kwargs):
        if self.is_owner:
            # Enforce that owners retain all permissions and stay active
            self.can_create_meeting = True
            self.can_delete_meeting = True
            self.can_use_ai = True
            if self.status == 'suspended':
                raise ValidationError(_("Organization owner cannot be suspended."))
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.user} in {self.org.name}"
