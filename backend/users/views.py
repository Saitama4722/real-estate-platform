"""
Auth views: login (JWT pair), refresh, current user.
"""
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import CurrentUserSerializer, EmailTokenObtainPairSerializer


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Body: {"email": "...", "password": "..."}
    Returns: {"access": "...", "refresh": "..."}
    Only active users can log in.
    """
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [AllowAny]


class RefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh/
    Body: {"refresh": "..."}
    Returns: {"access": "..."}
    """
    permission_classes = [AllowAny]


class CurrentUserView(generics.RetrieveAPIView):
    """
    GET /api/auth/me/
    Returns current authenticated user. Requires valid JWT access token.
    """
    serializer_class = CurrentUserSerializer
    # IsAuthenticated is the default from settings; no need to set permission_classes

    def get_object(self):
        return self.request.user
