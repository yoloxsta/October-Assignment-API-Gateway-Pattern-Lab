# EC2 Instance Module

This module creates an EC2 instance with configurable root volume.

## Usage

```hcl
module "ec2" {
  source = "./modules/ec2"

  name           = "my-app-server"
  ami            = "ami-0e5497a77ef21b5ac"
  instance_type  = "t3.micro"
  key_name       = "my-key-pair"
  subnet_id      = "subnet-12345678"
  
  vpc_security_group_ids = ["sg-12345678"]
  
  associate_public_ip_address = true
  root_volume_size            = 8

  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| name | Name tag for EC2 instance | `string` | n/a | yes |
| ami | AMI ID for the instance | `string` | n/a | yes |
| instance_type | EC2 instance type | `string` | `"t3.micro"` | no |
| key_name | Key pair name for SSH access | `string` | n/a | yes |
| subnet_id | Subnet ID for the instance | `string` | n/a | yes |
| vpc_security_group_ids | List of security group IDs | `list(string)` | n/a | yes |
| associate_public_ip_address | Whether to associate a public IP | `bool` | `true` | no |
| root_volume_size | Size of the root volume in GB | `number` | `8` | no |
| root_volume_type | Type of the root volume | `string` | `"gp3"` | no |
| tags | Tags to apply to the instance | `map(string)` | `{}` | no |
| user_data | User data script to run on instance launch | `string` | `""` | no |

## Outputs

| Name | Description |
|------|-------------|
| instance_id | ID of the EC2 instance |
| public_ip | Public IP address of the instance |
| private_ip | Private IP address of the instance |
| public_dns | Public DNS of the instance |
| instance_url | HTTP URL of the instance |
| ssh_command | SSH command to connect to the instance |
