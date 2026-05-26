import { createRouter, createWebHistory } from 'vue-router'

import Login from '../views/login.vue'
import Dashboard from '../views/dashboard.vue'
import LogForm from '../views/logform.vue'
import CompanyRoom from '../views/companyroom.vue'
import JoinRoom from '../views/joinroom.vue'
import Signup from '@/views/signup.vue'
import RoomDetail from '@/views/roomdetail.vue'
import Askai from '@/views/askai.vue'
import Resetpassword from '@/views/resetpassword.vue'
import Userlogs from '@/views/userlogs.vue'
import Preference from '@/views/preference.vue'
import Adminpreference from '@/views/adminpreference.vue'

const routes = [
  { path: '/', name: 'Login', component: Login },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard },
  { path: '/log', name: 'LogForm', component: LogForm },
  { path: '/company', name: 'CompanyRoom', component: CompanyRoom },
  { path: '/join', name: 'JoinRoom', component: JoinRoom },
  { path: '/signup', name: 'Signup', component: Signup },
  { path: '/roomdetail/:id', name: 'RoomDetail', component: RoomDetail },
  { path: '/askai', name:'AskAI', component:Askai},
  { path: '/reset-password', name:Resetpassword, component:Resetpassword},
  { path: '/userlogs', name:Userlogs, component:Userlogs},
  { path: '/preferences', name:Preference, component:Preference},
  { path: '/adminpreferences', name:Adminpreference, component:Adminpreference},

]

export default createRouter({
  history: createWebHistory(),
  routes,
})