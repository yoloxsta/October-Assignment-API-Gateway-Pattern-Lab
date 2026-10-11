# Security Group Module

This module creates a security group with dynamic ingress rules for specified ports.

## Usage

```hcl
module "security_group" {
  source = "./modules/security-group"

  name              = "my-app-sg"
  description       = "Security group for my application"
  vpc_id            = "vpc-12345678"
  allowed_ports     = [22, 80, 443]
  allowed_ssh_cidr  = "0.0.0.0/0"

  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| name | Name of the security group | `string` | n/a | yes |
| description | Description of the security group | `string` | `"Security group managed by Terraform"` | no |
| vpc_id | VPC ID where security group will be created | `string` | n/a | yes |
| allowed_ports | List of ports to allow in security group | `list(number)` | n/a | yes |
| allowed_ssh_cidr | CIDR block allowed for SSH access | `string` | `"0.0.0.0/0"` | no |
| tags | Tags to apply to security group | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| security_group_id | ID of the security group |
| security_group_arn | ARN of the security group |
| security_group_name | Name of the security group |
