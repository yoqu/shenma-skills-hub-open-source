pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    parameters {
        string(name: 'BRANCH_NAME', defaultValue: 'develop', description: '要部署的 Git 分支')
    }

    stages {
        stage('Checkout') {
            steps {
                cleanWs()
                checkout scm
            }
        }

        stage('Build Frontend') {
            steps {
                sh 'cd frontend && npm ci && npm run build'
            }
        }

        stage('Build Backend Jar') {
            steps {
                sh 'cd backend && mvn -B clean package -DskipTests'
            }
        }

        stage('Deploy') {
            steps {
                sh 'chmod +x deploy/deploy.sh'
                sh './deploy/deploy.sh release'
                sh './deploy/deploy.sh status'
            }
        }
    }

    post {
        success {
            echo 'SkillStack deployment succeeded.'
        }
        failure {
            echo 'SkillStack 部署失败，请查看 Jenkins 控制台日志。'
            sh 'docker logs --tail=200 skillstack-backend || true'
        }
    }
}
