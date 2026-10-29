from django.urls import path
from .views import (
    SendOTPView,
    VerifyOTPView,
    RegisterView,
    LoginView,
    RefreshTokenView,
    LogoutView,
    CSRFTokenView,
    MeProfileView,
)

app_name = 'authentication'

urlpatterns = [
    path('send-otp/', SendOTPView.as_view(), name='send-otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', RefreshTokenView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('csrf/', CSRFTokenView.as_view(), name='csrf'),
    path('me/', MeProfileView.as_view(), name='me'),
]

