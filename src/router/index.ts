import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import AudioFormView from '@/views/audios/AudioFormView.vue'
import AudioIndexView from '@/views/audios/AudioIndexView.vue'
import AudioShowView from '@/views/audios/AudioShowView.vue'
import DashboardView from '@/views/DashboardView.vue'
import HomeView from '@/views/HomeView.vue'
import ForgotPasswordView from '@/views/auth/ForgotPasswordView.vue'
import GoogleCallbackView from '@/views/auth/GoogleCallbackView.vue'
import LoginView from '@/views/auth/LoginView.vue'
import RegisterView from '@/views/auth/RegisterView.vue'
import ResetPasswordView from '@/views/auth/ResetPasswordView.vue'
import VerifyEmailView from '@/views/auth/VerifyEmailView.vue'
import ModeFormView from '@/views/modes/ModeFormView.vue'
import ModeIndexView from '@/views/modes/ModeIndexView.vue'
import ModeShowView from '@/views/modes/ModeShowView.vue'
import SettingsCustomizationView from '@/views/settings/SettingsCustomizationView.vue'
import UserFormView from '@/views/users/UserFormView.vue'
import UserIndexView from '@/views/users/UserIndexView.vue'
import UserShowView from '@/views/users/UserShowView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/login',
      redirect: (to) => ({ name: 'login', query: to.query }),
    },
    {
      path: '/auth/login',
      name: 'login',
      component: LoginView,
      meta: { guestOnly: true },
    },
    {
      path: '/auth/google/callback',
      name: 'google-callback',
      component: GoogleCallbackView,
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: GoogleCallbackView,
    },
    {
      path: '/auth/register',
      name: 'register',
      component: RegisterView,
      meta: { guestOnly: true },
    },
    {
      path: '/auth/verify-email',
      name: 'verify-email',
      component: VerifyEmailView,
    },
    {
      path: '/auth/email/verify/:id/:hash',
      name: 'email-verification-link',
      component: VerifyEmailView,
    },
    {
      path: '/auth/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordView,
      meta: { guestOnly: true },
    },
    {
      path: '/auth/reset-password',
      redirect: { name: 'forgot-password' },
    },
    {
      path: '/auth/reset-password/:token',
      name: 'reset-password',
      component: ResetPasswordView,
      meta: { guestOnly: true },
    },
    {
      path: '/core',
      name: 'core',
      component: DashboardView,
    },
    {
      path: '/settings',
      redirect: { name: 'settings-account' },
    },
    {
      path: '/settings/account',
      name: 'settings-account',
      component: UserFormView,
      props: { mode: 'settings' },
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/customization',
      name: 'settings-customization',
      component: SettingsCustomizationView,
      meta: { requiresAuth: true },
    },
    {
      path: '/modes',
      name: 'modes-index',
      component: ModeIndexView,
      meta: { requiresAuth: true },
    },
    {
      path: '/modes/create',
      name: 'modes-create',
      component: ModeFormView,
      props: { mode: 'create' },
      meta: { requiresAuth: true, adminOnly: true },
    },
    {
      path: '/modes/:id',
      name: 'modes-show',
      component: ModeShowView,
      meta: { requiresAuth: true },
    },
    {
      path: '/modes/:id/edit',
      name: 'modes-edit',
      component: ModeFormView,
      props: { mode: 'edit' },
      meta: { requiresAuth: true, adminOnly: true },
    },
    {
      path: '/audios',
      name: 'audios-index',
      component: AudioIndexView,
      meta: { requiresAuth: true },
    },
    {
      path: '/audios/create',
      name: 'audios-create',
      component: AudioFormView,
      props: { mode: 'create' },
      meta: { requiresAuth: true, adminOnly: true },
    },
    {
      path: '/audios/:id',
      name: 'audios-show',
      component: AudioShowView,
      meta: { requiresAuth: true },
    },
    {
      path: '/audios/:id/edit',
      name: 'audios-edit',
      component: AudioFormView,
      props: { mode: 'edit' },
      meta: { requiresAuth: true, adminOnly: true },
    },
    {
      path: '/users',
      name: 'users-index',
      component: UserIndexView,
      meta: { requiresAuth: true, adminOnly: true },
    },
    {
      path: '/users/create',
      name: 'users-create',
      component: UserFormView,
      props: { mode: 'create' },
      meta: { requiresAuth: true, adminOnly: true },
    },
    {
      path: '/users/:id',
      name: 'users-show',
      component: UserShowView,
      meta: { requiresAuth: true, adminOnly: true },
    },
    {
      path: '/users/:id/edit',
      name: 'users-edit',
      component: UserFormView,
      props: { mode: 'edit' },
      meta: { requiresAuth: true, adminOnly: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  await auth.hydrate()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'core' }
  }

  if (to.meta.adminOnly && !auth.isAdmin) {
    return { name: 'core' }
  }
})

export default router
