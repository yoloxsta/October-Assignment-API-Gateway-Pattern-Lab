# Terraform configuration for multiple EC2 instances
# Uses modular architecture for reusability

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration (optional - uncomment to use)
  # backend "local" {
  #   path = "terraform.tfstate"
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

# ============================================
# Kong API Gateway Security Group
# ============================================
module "kong_sg" {
  source = "./modules/security-group"

  name             = "${var.kong_instance_name}-sg"
  description      = "Security group for Kong API Gateway and microservices"
  vpc_id           = var.vpc_id
  allowed_ports    = var.kong_allowed_ports
  allowed_ssh_cidr = var.allowed_ssh_cidr

  tags = {
    Environment = "development"
    Project     = "api-gateway-lab"
    Server      = "kong-api"
    ManagedBy   = "terraform"
  }
}

# ============================================
# Kong API Gateway EC2 Instance
# ============================================
module "kong_ec2" {
  source = "./modules/ec2"

  name          = var.kong_instance_name
  ami           = var.ami_id
  instance_type = var.kong_instance_type
  key_name      = var.key_name
  subnet_id     = var.subnet_id

  vpc_security_group_ids = [module.kong_sg.security_group_id]

  associate_public_ip_address = true
  root_volume_size            = var.kong_root_volume_size
  root_volume_type            = "gp3"

  tags = {
    Environment = "development"
    Project     = "api-gateway-lab"
    Role        = "api-gateway"
    ManagedBy   = "terraform"
  }
}

/*
# ============================================
# Web Server Security Group
# ============================================
module "web_sg" {
  source = "./modules/security-group"

  name             = "${var.web_instance_name}-sg"
  description      = "Security group for Web Server"
  vpc_id           = var.vpc_id
  allowed_ports    = var.web_allowed_ports
  allowed_ssh_cidr = var.allowed_ssh_cidr

  tags = {
    Environment = "development"
    Project     = "api-gateway-lab"
    Server      = "web-server"
    ManagedBy   = "terraform"
  }
}

# ============================================
# Web Server EC2 Instance
# ============================================
module "web_ec2" {
  source = "./modules/ec2"

  name          = var.web_instance_name
  ami           = var.ami_id
  instance_type = var.web_instance_type
  key_name      = var.key_name
  subnet_id     = var.subnet_id

  vpc_security_group_ids = [module.web_sg.security_group_id]

  associate_public_ip_address = true
  root_volume_size            = var.web_root_volume_size
  root_volume_type            = "gp3"

  tags = {
    Environment = "development"
    Project     = "api-gateway-lab"
    Role        = "web-server"
    ManagedBy   = "terraform"
  }
}
===== */
